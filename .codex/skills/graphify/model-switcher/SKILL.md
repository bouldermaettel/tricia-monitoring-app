---
name: model-switcher
description: Switch Codex model settings in `.codex/config.toml` for Azure OpenAI projects.
---

# /model-switch

Update `.codex/config.toml` keys:
- `model = "..."`
- `model_provider = "azure"`
- `model_reasoning_effort = "low|medium|high|xhigh|max|ultra"` (when requested)

Do not change `[model_providers.azure]` unless asked.