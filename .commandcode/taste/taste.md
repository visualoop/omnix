# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
See [workflow/taste.md](workflow/taste.md)
# architecture
- Password reset must work locally without requiring email delivery — target users in Kenya don't rely on email. Confidence: 0.70
- Emails should be sent through the local website rather than external email services when possible. Confidence: 0.65

# frontend
- Use theme CSS variables (e.g., bg- classes) consistently across all components — POS areas, quick add headers/footers, subtotal/total regions, product cards, settings, and print views must all respect dark/light mode. Theming is the highest priority for frontend work. Confidence: 0.75
- Apply strong UI/UX design skills proactively to every feature — never ship functional but visually unpolished UI. Visual quality and theme consistency are as important as functionality. Confidence: 0.70
- Print views must render cleanly without UI chrome (buttons, nav, etc.) and should output in light mode regardless of current theme. Use dedicated print styles or a print-specific rendering method. Confidence: 0.70

# architecture
- Reuse existing working implementations across modules — when a feature already works in one module (e.g., customer display in pharmacy), reuse that same code/pattern instead of building a separate implementation. Confidence: 0.65

