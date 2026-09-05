from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_cases: int
    revenue_at_risk_minor: int
    revenue_at_risk_inr: float
    average_recovery_probability: float
    high_risk_cases: int
    explanations_generated: int
