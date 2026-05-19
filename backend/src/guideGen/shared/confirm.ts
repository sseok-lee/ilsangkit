import readline from 'node:readline';

export interface ConfirmOpts {
  yes: boolean;
  action: string;
}

export async function confirmDestructive(opts: ConfirmOpts): Promise<boolean> {
  if (opts.yes) return true;
  if (!process.stdin.isTTY) {
    console.error(
      `[confirm] ${opts.action} is destructive; pass --yes to confirm (no TTY available for interactive prompt).`
    );
    return false;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`Confirm ${opts.action}? [y/N] `, resolve);
  });
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
