# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
- Don't change what's already implemented — only add new work on top. Confidence: 0.75
- Thoroughly explore and verify the codebase state before planning or implementing. Confidence: 0.60
- After completing tasks, proactively analyze adjacent areas for integration gaps, dead code, silent failures, and other issues without waiting to be asked. Confidence: 0.60
- When proactive analysis identifies issues, fix them directly rather than just reporting them. Confidence: 0.65
- Fix all identified issues comprehensively rather than prioritizing a subset — batch-fix everything found. Confidence: 0.65

# architecture
- Password reset must work locally without requiring email delivery — target users in Kenya don't rely on email. Confidence: 0.70
- Emails should be sent through the local website rather than external email services when possible. Confidence: 0.65

