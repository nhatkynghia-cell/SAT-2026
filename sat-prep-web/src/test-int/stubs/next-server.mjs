/**
 * Stub tối thiểu cho `next/server`. NextResponse vừa dùng kiểu constructor
 * (`new NextResponse(body, init)` — vd IPN trả 204 no-content) vừa dùng static
 * `NextResponse.json(...)`. Kế thừa Response chuẩn (global) để test đọc
 * .status / .json() / .text() y như runtime thật.
 */
export class NextResponse extends Response {
  static json(body, init) {
    const status = init?.status ?? 200;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }
}

/**
 * Stub NextRequest: route exam-session/submit import NextRequest (dùng làm kiểu
 * tham số + đọc request.nextUrl.origin ở nhánh Module 1). Kế thừa Request chuẩn để
 * .json()/.headers hoạt động; thêm getter nextUrl trả URL để .origin không vỡ.
 */
export class NextRequest extends Request {
  get nextUrl() {
    return new URL(this.url || 'http://localhost/');
  }
}
