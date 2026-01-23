import re
from typing import Dict, List

# Regex to capture placeholders like $name or $age
_VAR_PATTERN = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)")


def extract_variables(system_prompt: str) -> List[str]:
    """Return a sorted list of unique variable names declared as $var in the prompt."""
    if not system_prompt:
        return []
    return sorted(set(_VAR_PATTERN.findall(system_prompt)))


def render_prompt(system_prompt: str, variables: Dict[str, str], *, strict: bool = True) -> str:
    """Replace $var placeholders with provided values.

    When strict=True (default), missing values raise an error. When strict=False,
    missing values are kept as-is in the prompt.
    """
    if not system_prompt:
        return system_prompt

    variables = variables or {}
    missing = [name for name in extract_variables(system_prompt) if not variables.get(name)]
    if strict and missing:
        raise ValueError(
            "Missing variable values for: " + ", ".join(missing)
        )

    def _sub(match: re.Match) -> str:
        name = match.group(1)
        if name in variables and variables.get(name) not in (None, ""):
            return str(variables.get(name))
        return match.group(0)

    return _VAR_PATTERN.sub(_sub, system_prompt)
