const _supportsUnicode = (() => {
  if (process.platform === 'win32') {
    return Boolean(
      process.env.WT_SESSION ||
      process.env.TERM_PROGRAM === 'vscode' ||
      process.env.TERM === 'xterm-256color',
    );
  }
  const lang = process.env.LANG ?? process.env.LC_ALL ?? '';
  return lang.toLowerCase().includes('utf');
})();

export const terminal = {
  isInteractive:
    Boolean(process.stdout.isTTY) &&
    !process.env.CI &&
    !process.env.CONTINUOUS_INTEGRATION &&
    !process.env.GITHUB_ACTIONS,
  supportsUnicode: _supportsUnicode,
};

export const symbols = {
  success: _supportsUnicode ? '✔' : 'v',
  error:   _supportsUnicode ? '✖' : 'x',
  warning: _supportsUnicode ? '⚠' : '!',
  info:    _supportsUnicode ? 'ℹ' : 'i',
};
