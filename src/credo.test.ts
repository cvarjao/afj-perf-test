import { describe, expect, test } from "@jest/globals";
import { createAgent } from "./AgentCredo";
import { ConsoleLogger, LogLevel } from "@credo-ts/core";
type AgentType = Awaited<ReturnType<typeof createAgent>>

describe.skip("credo", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ledgers = require("../ledgers.json");
  let agent: AgentType;
  
  beforeAll(async () => {
    console.log('1 - beforeAll')
    agent = await createAgent({}, ledgers, new ConsoleLogger(LogLevel.trace));
  }, 20000);
  afterAll(async () => {
    console.log('1 - afterAll')
    await agent.mediationRecipient?.stopMessagePickup();
    await agent.shutdown();
  }, 20000);
  test("something", async () => {
    expect(1 + 2).toBe(3);
  }, 20000);
});
