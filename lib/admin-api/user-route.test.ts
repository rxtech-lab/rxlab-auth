import { describe, expect, mock, test } from "bun:test";
import { handleUserListRequest } from "./user-route";

const emptyResult = {
  users: [],
  pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
};

describe("user admin API request handler", () => {
  test("returns the authorization failure unchanged", async () => {
    const response = await handleUserListRequest(
      new Request("https://auth.example.com/api/admin/users") as never,
      {
        authorize: mock(() =>
          Promise.resolve({
            ok: false as const,
            response: Response.json(
              { error: "insufficient_permission" },
              { status: 403 },
            ),
          } as never),
        ),
        list: mock(() => Promise.resolve(emptyResult)),
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "insufficient_permission",
    });
  });

  test("passes pagination and an optional trimmed keyword", async () => {
    const list = mock(() =>
      Promise.resolve({
        ...emptyResult,
        pagination: { ...emptyResult.pagination, page: 2, pageSize: 10 },
      }),
    );
    const response = await handleUserListRequest(
      new Request(
        "https://auth.example.com/api/admin/users?page=2&pageSize=10&keyword=%20alice%20",
      ) as never,
      {
        authorize: mock(() => Promise.resolve({ ok: true as const })),
        list,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      keyword: "alice",
    });
  });

  test("rejects an oversized keyword before querying", async () => {
    const list = mock(() => Promise.resolve(emptyResult));
    const response = await handleUserListRequest(
      new Request(
        `https://auth.example.com/api/admin/users?keyword=${"a".repeat(101)}`,
      ) as never,
      {
        authorize: mock(() => Promise.resolve({ ok: true as const })),
        list,
      },
    );

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  test("returns a JSON server error when the list query fails", async () => {
    const consoleError = console.error;
    console.error = mock(() => {});

    try {
      const response = await handleUserListRequest(
        new Request("https://auth.example.com/api/admin/users") as never,
        {
          authorize: mock(() => Promise.resolve({ ok: true as const })),
          list: mock(() => Promise.reject(new Error("database unavailable"))),
        },
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "server_error" });
    } finally {
      console.error = consoleError;
    }
  });
});
