import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadVocab, saveVocab } from '@/lib/vocab-store';
import { promote, nextReview, isDue } from '@/lib/leitner';
import { loadEconomy, saveEconomy, tryClaimOnceAtomic } from '@/lib/economy-store';
import { applyExamRewardFromDifficulties } from '@/lib/economy';
import { getUserTier } from '@/lib/subscription-store';
import { TIER_COIN_MULTIPLIER } from '@/lib/subscription';
import { recordAnswer } from '@/lib/mastery';

// Sentinel bucket cho thưởng ôn từ vựng trong quest_claims (cùng cơ chế claim-once
// atomic với dailyLogin/streak). itemId = `${wordId}:${next_review gốc}` → mỗi
// due-instance của từ chỉ được thưởng 1 lần, chống 2 POST đồng thời cộng đôi.
const VOCAB_REWARD_KEY = '__vocab_reward__';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const data = await loadVocab(user.id);

    // Lọc ra các từ cần ôn tập hôm nay (Leitner — dùng helper chung).
    const dueWords = data.words.filter((w) => isDue(w.next_review));

    return NextResponse.json({ words: dueWords });
  } catch (error) {
    console.error("Lỗi khi load từ vựng:", error);
    return NextResponse.json({ error: "Failed to load vocab" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { wordId, isRemembered } = await req.json();

    const data = await loadVocab(user.id);

    const wordIndex = data.words.findIndex((w) => w.id === wordId);
    if (wordIndex === -1) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const word = data.words[wordIndex];

    // 🔴 ROOT A follow-up (đường thi/ôn): thưởng ôn từ vựng nay do SERVER quyết,
    // KHÔNG còn client POST `/api/economy {action:'exam'}`. Chỉ thưởng khi:
    //   (1) từ THẬT SỰ đến hạn ôn (isDue theo next_review HIỆN TẠI, trước khi cập
    //       nhật) → chống farm: POST lại cùng wordId sau khi đã ôn thì next_review
    //       đã đẩy về tương lai ⇒ không due ⇒ không thưởng.
    //   (2) người học bấm "đã nhớ" (isRemembered) — ôn đúng 1 từ = 1 câu Easy.
    // Khóa idempotent theo DUE-INSTANCE: next_review GỐC (trước khi Leitner đẩy về
    // tương lai ở dòng dưới) → 2 POST cùng wordId đồng thời chỉ thưởng 1 lần; lần
    // due kế (next_review khác) vẫn thưởng được. 'new' cho từ chưa từng ôn.
    const dueKey = word.next_review ?? 'new';
    const wasDue = isDue(word.next_review);

    // Cập nhật box + lịch ôn theo Leitner (helper chung, hết trùng lặp).
    word.box = promote(word.box ?? 1, !!isRemembered);
    word.next_review = nextReview(word.box);

    data.words[wordIndex] = word;
    await saveVocab(user.id, data);

    // Nuôi mastery rw.vocab: ôn từ vựng là tín hiệu học THẬT nhưng trước đây KHÔNG
    // ghi mastery → adaptive/skill-tree/dashboard mù với tiến bộ từ vựng. Ghi CHỈ
    // khi từ THẬT SỰ đến hạn (wasDue) — nhất quán với gate chống-farm của phần
    // thưởng ở trên, tránh spam ôn từ đã thuộc để thổi mastery (đụng score-
    // prediction). "đã nhớ"→đúng, "quên"→sai (tín hiệu âm mạnh). Fire-and-forget:
    // try/catch nuốt lỗi để KHÔNG chặn phản hồi ôn từ (mẫu /api/grade).
    if (wasDue) {
      try {
        await recordAnswer(user.id, 'rw.vocab', !!isRemembered, 'Easy');
      } catch (e) {
        console.error('recordAnswer(rw.vocab) lỗi (không chặn ôn từ):', e);
      }
    }

    let granted = { coins: 0, xp: 0 };
    if (wasDue && isRemembered) {
      const tier = await getUserTier(user.id);
      // Delta thưởng ĐỘC LẬP số dư (chỉ theo độ khó × hệ số tier) → tính từ state
      // rỗng cũng ra đúng delta; chỉ dùng .granted, KHÔNG dùng .state (tránh
      // read-modify-write hở race).
      const delta = applyExamRewardFromDifficulties(
        { coins: 0, xp: 0, inventory: [], lastSpinDate: null },
        ['Easy'],
        TIER_COIN_MULTIPLIER[tier]
      ).granted;

      if (delta.coins > 0 || delta.xp > 0) {
        // 🔴 ROOT C (chống race đúc xu): cộng xu ATOMIC + idempotent theo due-instance
        // qua RPC claim-once (khóa dòng + kiểm (bucket,itemId) trong 1 transaction).
        // 2 POST cùng wordId đồng thời → chỉ 1 cộng, cái sau 'already_claimed'.
        const itemId = `${wordId}:${dueKey}`;
        const atomic = await tryClaimOnceAtomic(user.id, VOCAB_REWARD_KEY, itemId, delta.coins, delta.xp);
        if (atomic) {
          if (atomic.ok) {
            granted = delta;
            // RPC trả tổng coins/xp mới nhưng không kèm inventory → reload full state
            // cho client syncServerEconomy (hợp đồng cũ: trả economy đầy đủ).
            const economy = await loadEconomy(user.id);
            return NextResponse.json({ success: true, word, granted, economy });
          }
          if (atomic.reason === 'already_claimed') {
            // Đã thưởng due-instance này rồi (POST trùng) → không cộng lại.
            const economy = await loadEconomy(user.id);
            return NextResponse.json({ success: true, word, granted, economy });
          }
          // rpc_error → fail-closed; no_row → rơi xuống fallback (tạo row).
          if (atomic.reason !== 'no_row') {
            return NextResponse.json({ success: false, error: 'Không thể nhận thưởng lúc này.' }, { status: 500 });
          }
        }

        // ── FALLBACK non-atomic (pre-migration / no_row) — hành vi CŨ, 0 regression ──
        const economy = await loadEconomy(user.id);
        const reward = applyExamRewardFromDifficulties(economy, ['Easy'], TIER_COIN_MULTIPLIER[tier]);
        await saveEconomy(user.id, reward.state);
        granted = reward.granted;
        return NextResponse.json({ success: true, word, granted, economy: reward.state });
      }
    }

    return NextResponse.json({ success: true, word, granted });
  } catch (error) {
    console.error("Lỗi khi cập nhật tiến độ từ vựng:", error);
    return NextResponse.json({ error: "Failed to update vocab" }, { status: 500 });
  }
}
