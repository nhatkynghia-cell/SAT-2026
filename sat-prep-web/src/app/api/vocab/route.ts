import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { loadVocab, saveVocab } from '@/lib/vocab-store';
import { promote, nextReview, isDue } from '@/lib/leitner';
import { loadEconomy, saveEconomy, tryClaimOnceAtomic, ensureEconomyRow } from '@/lib/economy-store';
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

    // Khóa idempotent theo DUE-INSTANCE: next_review GỐC (trước khi Leitner đẩy về
    // tương lai) → 2 POST cùng wordId đồng thời chỉ thưởng 1 lần; lần due kế
    // (next_review khác) vẫn thưởng được. 'new' cho từ chưa từng ôn.
    const dueKey = word.next_review ?? 'new';
    const wasDue = isDue(word.next_review);

    // Tính TRƯỚC trạng thái Leitner mới (CHƯA lưu) — lưu SAU khi đã chốt thưởng, để
    // rpc_error KHÔNG đẩy next_review về tương lai làm mất due-instance khi retry.
    const newBox = promote(word.box ?? 1, !!isRemembered);
    const newNextReview = nextReview(newBox);

    // ── THƯỞNG (chốt TRƯỚC khi advance Leitner) ──
    let granted = { coins: 0, xp: 0 };
    if (wasDue && isRemembered) {
      const tier = await getUserTier(user.id);
      // Delta ĐỘC LẬP số dư (chỉ theo độ khó × hệ số tier) → dùng .granted, KHÔNG
      // dùng .state (tránh read-modify-write hở race).
      const delta = applyExamRewardFromDifficulties(
        { coins: 0, xp: 0, inventory: [], lastSpinDate: null },
        ['Easy'],
        TIER_COIN_MULTIPLIER[tier]
      ).granted;

      if (delta.coins > 0 || delta.xp > 0) {
        // Đảm bảo có dòng user_economy TRƯỚC RPC: claim_quest_reward khóa dòng bằng
        // SELECT..FOR UPDATE, chỉ tuần tự hóa được khi dòng TỒN TẠI. Không có dòng →
        // RPC no_row → đường non-atomic không ghi claim → user mới + 2 POST đồng thời
        // double-grant. Tạo dòng trước → RPC luôn claim-once đúng.
        await ensureEconomyRow(user.id);

        // 🔴 ROOT C: cộng xu ATOMIC + idempotent theo due-instance (khóa dòng + kiểm
        // (bucket,itemId) 1 transaction). itemId = wordId:next_review GỐC.
        const itemId = `${wordId}:${dueKey}`;
        const atomic = await tryClaimOnceAtomic(user.id, VOCAB_REWARD_KEY, itemId, delta.coins, delta.xp);
        if (atomic) {
          if (atomic.ok) {
            granted = delta;
          } else if (atomic.reason !== 'already_claimed') {
            // rpc_error / (no_row bất thường sau ensureRow) → fail-closed. CHƯA lưu
            // Leitner → retry vẫn thấy due → không mất thưởng vĩnh viễn.
            return NextResponse.json({ success: false, error: 'Không thể nhận thưởng lúc này.' }, { status: 500 });
          }
          // already_claimed → granted giữ 0 (POST trùng), tiếp tục advance Leitner.
        } else {
          // atomic === null: RPC CHƯA migrate (pre-migration) → fallback non-atomic
          // (hành vi cũ, race hở như trước tới khi migrate — 0 regression).
          const economy = await loadEconomy(user.id);
          const reward = applyExamRewardFromDifficulties(economy, ['Easy'], TIER_COIN_MULTIPLIER[tier]);
          await saveEconomy(user.id, reward.state);
          granted = reward.granted;
        }
      }
    }

    // ── ADVANCE LEITNER (SAU khi thưởng đã chốt) ──
    word.box = newBox;
    word.next_review = newNextReview;
    data.words[wordIndex] = word;
    await saveVocab(user.id, data);

    // Nuôi mastery rw.vocab: ôn từ vựng là tín hiệu học THẬT. Ghi CHỈ khi từ THẬT SỰ
    // đến hạn (wasDue) — nhất quán gate chống-farm. "đã nhớ"→đúng, "quên"→sai.
    // Fire-and-forget: try/catch nuốt lỗi để KHÔNG chặn phản hồi ôn từ.
    if (wasDue) {
      try {
        await recordAnswer(user.id, 'rw.vocab', !!isRemembered, 'Easy');
      } catch (e) {
        console.error('recordAnswer(rw.vocab) lỗi (không chặn ôn từ):', e);
      }
    }

    // Trả full economy cho client syncServerEconomy (hợp đồng: economy đầy đủ).
    const economy = await loadEconomy(user.id);
    return NextResponse.json({ success: true, word, granted, economy });
  } catch (error) {
    console.error("Lỗi khi cập nhật tiến độ từ vựng:", error);
    return NextResponse.json({ error: "Failed to update vocab" }, { status: 500 });
  }
}
