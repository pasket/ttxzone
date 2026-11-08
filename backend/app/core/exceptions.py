"""Custom application exceptions.

Kept intentionally minimal: a single base carrying everything the global
error-response contract needs (see app.main's exception handlers and
app.middlewares.exception_mw). Specific subclasses (NotFoundError,
ValidationError, etc.) should only be introduced once real business logic
exists to justify them (Auth+RBAC / TTX phase).
"""

import logging


class AppException(Exception):
    """Base class for application-raised errors rendered through the
    unified `{"success": false, "error": {...}}` response contract.
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        ttx_id: str | None = None,
        log_level: int = logging.ERROR,
        logger_name: str | None = None,
        params: dict | None = None,
    ) -> None:
        self.code = code
        # `message` is English with `{placeholders}` for `params`: it is the
        # key the client's language is looked up by (app.core.i18n), so the
        # values never go into the text at the raise site.
        self.template = message
        self.params = params
        message = message.format(**params) if params else message
        self.message = message
        self.status_code = status_code
        # Echoed in the error body; only set by a raise site that wants
        # the client to know which exercise the error is about.
        self.ttx_id = ttx_id
        # Defaults to ERROR (business-logic/DB-constraint-style failures per
        # CLAUDE.md's log-level semantics); callers pass logging.WARNING for
        # expected, client-caused rejections (bad credentials, duplicate
        # email, etc.) that aren't actually server faults.
        self.log_level = log_level
        # Lets a specific raise site route through a dedicated logger (e.g.
        # onboarding/login events -> auth.log) without matching on `code`,
        # which isn't unique to one domain (INVALID_CREDENTIALS is reused by
        # login, TOTP-disable, and change-password alike). None keeps the
        # existing generic behavior (app.main).
        self.logger_name = logger_name
        super().__init__(message)
