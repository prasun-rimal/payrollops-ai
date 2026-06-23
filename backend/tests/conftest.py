import os
from pathlib import Path


test_database = Path("/tmp/payrollops-api-tests.db")
test_database.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{test_database}"
os.environ["AI_PROVIDER"] = "mock"
os.environ["GEMINI_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""
