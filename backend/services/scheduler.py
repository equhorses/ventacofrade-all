"""Lightweight in-process scheduler — no separate Railway service needed.

Runs services.scheduled_jobs.run_daily_jobs() once a day, and
send_pending_invitation_emails() every 2 hours (to trickle out bulk
invitations gradually instead of sending them all at once). Started from
main.py's lifespan on app startup, stopped on shutdown.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from services.seller_plan_jobs import auto_bump_pro_listings, send_monthly_reports
from services.scheduled_jobs import (
    run_daily_jobs,
    send_pending_invitation_emails,
    send_launch_campaign_emails,
    check_signup_deadlines,
)

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    _scheduler = AsyncIOScheduler(timezone="UTC")
    # 08:00 UTC ≈ 09:00/10:00 hora peninsular española (según horario de verano/invierno).
    _scheduler.add_job(run_daily_jobs, CronTrigger(hour=8, minute=0), id="daily_jobs", replace_existing=True)
    # Envío gradual de invitaciones pendientes, en tandas pequeñas, cada 2 horas.
    _scheduler.add_job(
        send_pending_invitation_emails, IntervalTrigger(hours=2), id="invitation_email_batches", replace_existing=True
    )
    # Campaña de recordatorio pre-lanzamiento (catálogo + activación), misma cadencia de 2 horas.
    _scheduler.add_job(
        send_launch_campaign_emails, IntervalTrigger(hours=2), id="launch_campaign_batches", replace_existing=True
    )
    # Plazo de 18 días (cuenta creada -> tienda terminada): recordatorio y expiración.
    _scheduler.add_job(
        check_signup_deadlines, IntervalTrigger(hours=2), id="signup_deadline_checks", replace_existing=True
    )
    # Ventajas de los planes: subida automática semanal (Profesional) y resumen mensual.
    _scheduler.add_job(auto_bump_pro_listings, CronTrigger(hour=7, minute=0), id="auto_bump_pro", replace_existing=True)
    _scheduler.add_job(
        send_monthly_reports, CronTrigger(day=1, hour=9, minute=0), id="monthly_reports", replace_existing=True
    )
    _scheduler.start()
    logger.info(
        "Scheduler iniciado: trabajos diarios (sorteo + renovaciones + lanzamiento + purga de cuentas) a las 08:00 UTC, "
        "y envio de invitaciones/campana/plazo de registro en tandas cada 2 horas"
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler detenido")
