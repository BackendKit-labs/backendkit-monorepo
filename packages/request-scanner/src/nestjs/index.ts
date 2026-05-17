export * from './waf.options.js';
export * from './waf.middleware.js';
export * from './sanitize.pipe.js';
export * from './waf.module.js';

// RequestScanner* aliases — preferred names going forward; Waf* names remain for backwards compatibility
export { WafModule        as RequestScannerModule     } from './waf.module.js';
export { WafMiddleware     as RequestScannerMiddleware  } from './waf.middleware.js';
export { SanitizePipe      as RequestScannerPipe        } from './sanitize.pipe.js';
export { WAF_OPTIONS       as REQUEST_SCANNER_OPTIONS   } from './waf.options.js';
export type { WafModuleOptions as RequestScannerOptions } from './waf.options.js';
