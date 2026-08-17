import { describe, expect, mock, test } from "bun:test";
import { handleOAuthClientListRequest } from "./oauth-client-route";

const emptyResult = {
  clients: [],
  pagination: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
};

describe("OAuth client admin API request handler", () => {
  test("returns the authorization failure unchanged", async () => {
    const response = await handleOAuthClientListRequest(
      new Request("https://auth.example.com/api/admin/oauth-clients") as never,
      {
        authorize: mock(() =>
          Promise.resolve({
            ok: false as const,
            response: Response.json({ error: "invalid_token" }, { status: 401 }),
          } as never),
        ),
        list: mock(() => Promise.resolve(emptyResult)),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
  });

  test("passes pagination and selected-client access to the list service", async () => {
    const list = mock(() => Promise.resolve({
      ...emptyResult,
      pagination: { ...emptyResult.pagination, page: 2, pageSize: 10 },
    }));

    const response = await handleOAuthClientListRequest(
      new Request(
        "https://auth.example.com/api/admin/oauth-clients?page=2&pageSize=10",
      ) as never,
      {
        authorize: mock(() =>
          Promise.resolve({
            ok: true as const,
            access: { scope: "selected" as const, clientIds: ["client_1"] },
          }),
        ),
        list,
      },
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({
      access: { scope: "selected", clientIds: ["client_1"] },
      page: 2,
      pageSize: 10,
    });
  });

  test("requires a keyword on the search endpoint", async () => {
    const list = mock(() => Promise.resolve(emptyResult));
    const response = await handleOAuthClientListRequest(
      new Request(
        "https://auth.example.com/api/admin/oauth-clients/search",
      ) as never,
      {
        authorize: mock(() =>
          Promise.resolve({
            ok: true as const,
            access: { scope: "all" as const, clientIds: [] as [] },
          }),
        ),
        list,
      },
      { requireKeyword: true },
    );

    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  test("passes the trimmed search keyword to the list service", async () => {
    const list = mock(() => Promise.resolve(emptyResult));
    await handleOAuthClientListRequest(
      new Request(
        "https://auth.example.com/api/admin/oauth-clients/search?keyword=%20music%20",
      ) as never,
      {
        authorize: mock(() =>
          Promise.resolve({
            ok: true as const,
            access: { scope: "all" as const, clientIds: [] as [] },
          }),
        ),
        list,
      },
      { requireKeyword: true },
    );

    expect(list).toHaveBeenCalledWith({
      access: { scope: "all", clientIds: [] },
      page: 1,
      pageSize: 20,
      keyword: "music",
    });
  });

  test("returns a JSON server error when the list query fails", async () => {
    const consoleError = console.error;
    console.error = mock(() => {});

    try {
      const response = await handleOAuthClientListRequest(
        new Request("https://auth.example.com/api/admin/oauth-clients") as never,
        {
          authorize: mock(() =>
            Promise.resolve({
              ok: true as const,
              access: { scope: "all" as const, clientIds: [] as [] },
            }),
          ),
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
