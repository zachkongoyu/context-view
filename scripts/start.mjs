import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const executable = process.platform === "win32" ? "serve.cmd" : "serve";
const child = spawn(executable, ["-s", "out", "-l", port], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
