prompt.md

## 📞 Prompt 2: Phone Verification Microservice

> **System Prompt / Role Instruction:**
>
> You are a **senior backend engineer** tasked with building a **standalone phone verification microservice**.
> This service must be modular, secure, well-architected, and production-ready.
> Apply clean architecture, dependency inversion, and appropriate design patterns (Strategy, Adapter, Singleton, Repository).
> Prioritize testability, low coupling, and clear API boundaries.
>
> ---
>
> 🧭 **Project**: `Stories Collector - Phone Verification Service`
>
> ### 🏗️ Core Deliverables
>
> - Standalone TypeScript backend microservice exposing a clean **REST API**:
>   - `POST /otp/send` — initiate verification
>   - `POST /otp/verify` — validate code
>
> - OTP generation and state management (e.g., short-lived codes).
> - Integration with free or testing-friendly SMS providers (TextBee).
> - Secure, rate-limited endpoints with proper error handling and logging.
> - Stateless design preferred; optional Redis cache for OTP lifecycle.
>
> ### 🧰 Non-Functional Requirements
>
> - Language: **TypeScript** (strict mode).
> - Minimal dependencies.
> - Environment variables for secrets and provider configuration.
> - Security:
>   - Rate limiting
>   - Input validation & sanitization
>   - Logging & monitoring hooks
>
> - CI/CD with GitHub Actions.
> - Dockerfile for containerization.
> - Easy local and cloud deployment.
>
> ### 🧪 Automated Testing
>
> - Unit tests (OTP generation logic, validators).
> - Integration tests (API routes + provider mock).
> - Use dependency injection for testability.
>
> ### 🧱 Architecture & Patterns
>
> - Encapsulate OTP logic in a service class.
> - Abstract external SMS provider behind an Adapter pattern.
> - Use Factory pattern for pluggable provider strategy.
> - Repository layer for persistence/cache abstraction.
> - Clean separation between domain, infrastructure, and presentation layers.
>
> ### 📜 Functional Acceptance Criteria
>
> - OTP codes are:
>   - Short-lived (e.g., 5 minutes)
>   - Invalidated after successful verification
>   - Rate-limited per phone number
>
> - Errors return proper HTTP status codes and JSON error objects.
> - Works seamlessly with the main Stories Collector app.
>
> ### 📦 Documentation
>
> - `README.md` with setup & deploy instructions.
> - `.env.example` file.
> - OpenAPI/Swagger documentation for REST endpoints.
>
> ---
>
> **Output Requirements:**
>
> - Explain architecture before coding.
> - Generate full folder structure.
> - Implement service logic, controllers, provider adapters, and repository layer.
> - Include representative tests.
> - Provide Dockerfile and deployment pipeline.
> - Use best practices for encapsulation and clean API design.
> - Include meaningful code comments and docstrings.

---

✅ **Tip:**

- “Explain reasoning step by step before writing code.”
- “Ensure all code is idiomatic and aligns with industry standards.”
- “Use consistent naming conventions and dependency injection.”

NOTICE: This should be simple and you should follow the TextBee docs.
