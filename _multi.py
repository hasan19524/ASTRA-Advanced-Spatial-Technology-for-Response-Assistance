# Multi-provider free LLM backend (assistant + assessment, zero-cost, fallback chain)
class MultiLlmBackend:
    """Tries a list of OpenAI-compatible providers in order; raises
    `LlmBackendError` only if every provider fails. Wraps naturally in
    `DegradingBackend(primary, rules)` so total failure degrades to rules."""

    def __init__(self, providers: list[LlmBackend]) -> None:
        if not providers:
            raise ValueError("MultiLlmBackend needs at least one provider")
        self.providers = providers

    @property
    def name(self) -> str:
        return "multi:" + ",".join(p.model for p in self.providers)

    async def assess(self, *, title, description, region, reporter_email):
        last_exc = None
        for p in self.providers:
            try:
                return await p.assess(
                    title=title,
                    description=description,
                    region=region,
                    reporter_email=reporter_email,
                )
            except Exception as exc:
                last_exc = exc
                logger.warning("provider %s failed: %s; trying next", p.name, exc)
        raise LlmBackendError(f"all providers failed: {last_exc}")


def build_multi_llm_backend() -> MultiLlmBackend | None:
    providers = []
    if settings.groq_api_key:
        providers.append(
            LlmBackend(
                api_key=settings.groq_api_key,
                model=settings.groq_model,
                base_url=settings.groq_base_url,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        )
    if settings.openrouter_api_key:
        providers.append(
            LlmBackend(
                api_key=settings.openrouter_api_key,
                model=settings.openrouter_model,
                base_url=settings.openrouter_base_url,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        )
    if settings.nvidia_api_key:
        providers.append(
            LlmBackend(
                api_key=settings.nvidia_api_key,
                model=settings.nvidia_model,
                base_url=settings.nvidia_base_url,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        )
    # legacy single-provider fallback
    if not providers and settings.llm_api_key:
        providers.append(
            LlmBackend(
                api_key=settings.llm_api_key,
                model=settings.llm_model,
                base_url=settings.llm_base_url,
                timeout_seconds=settings.llm_timeout_seconds,
            )
        )
    if not providers:
        return None
    return MultiLlmBackend(providers)


def get_assessment_backend() -> AssessmentBackend:
    rules = RuleBackend()
    multi = build_multi_llm_backend()
    if multi is None:
        if settings.assessment_backend == "llm":
            logger.info(
                "LLM backend requested but no provider keys set - using rules_stub"
            )
        return rules
    return DegradingBackend(multi, rules)
