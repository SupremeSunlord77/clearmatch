// M8: `npm run demo` starts server and client like `npm run dev`, then prints the client URL and a
// short guide to the two demo stories. Needs no .env: the server loads output/ results, then the
// committed run 4 snapshot, then mock results. Nothing here calls the LLM.
import { spawn } from "node:child_process";

const GUIDE = (url) => `
================================================================
 ClearMatch demo is running: ${url}
 (Ctrl+C to stop. Demo-only controls are in the yellow "Demo control" bar.)
================================================================

 Story 1: real AI result, challenged and upheld (Brickwall, p7)
  1. Open ${url}/?player=p7 and click "Show details" on Respect:
     match 1 lowered the score; see the exact chat lines, the
     improvement acknowledgement and the tips.
  2. Click "Challenge this score" on match 1, choose a reason, submit.
  3. Click "Open simulated reviewer", read the evidence in context,
     add a comment, click "Uphold score".
  4. Back on the profile: "Upheld on review" and the comment.
  5. Click "Find next match": teams and "Why you're in this lobby".

 Story 2: SIMULATED AI error, challenged and overturned (Havoc, p5)
  1. Click "Reset demo", then open ${url}/lobby?player=p5 and note
     the teams and reasons.
  2. Click "Simulate an AI error" (the bar then says it is active).
  3. Open ${url}/?player=p5: Respect is Low, citing game language
     ("gonna kill it this round", "destroy their base").
  4. Click "Find next match": note the new reasons.
  5. Challenge match 3 (reason: "It was game language, not abuse"),
     open the simulated reviewer, click "Overturn score".
  6. Back on the profile: match 3 no longer counts; Respect is
     recalculated. Click "Find next match" again and compare.

 Click "Reset demo" to start again.
================================================================
`;

const ANSI = /\x1b\[[0-9;]*m/g;
let shown = false;

const child = spawn("npm run dev", { shell: true, stdio: ["inherit", "pipe", "inherit"] });

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (shown) return;
  const m = chunk.toString().replace(ANSI, "").match(/Local:\s+(http:\/\/\S+?)\/?\s/);
  if (m) {
    shown = true;
    process.stdout.write(GUIDE(m[1]));
  }
});

child.on("exit", (code) => process.exit(code ?? 0));
