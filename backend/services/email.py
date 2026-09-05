import logging
from typing import Optional

import httpx
from core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_welcome_email(to_email: str, name: Optional[str] = None) -> bool:
    """Send a welcome email via Resend. Never raises; returns True/False."""
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning("Resend no configurado (RESEND_API_KEY / RESEND_FROM_EMAIL); email de bienvenida omitido")
        return False

    display_name = name or to_email.split("@", 1)[0]

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">¡Bienvenido a VentaCofrade, {display_name}!</h2>
      <p>Gracias por registrarte en el marketplace de referencia para artículos cofrades.</p>
      <p>Ya puedes explorar orfebrería, bordados, túnicas y mucho más, o activar tu tienda de vendedor
      para empezar a publicar tus propios anuncios.</p>
      <p style="margin-top: 24px;">
        <a href="https://ventacofrade.com/vender" style="background-color:#6d28d9;color:#fff;
        padding:10px 20px;border-radius:6px;text-decoration:none;">Ver planes de vendedor</a>
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": "¡Bienvenido a VentaCofrade!",
        "html": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de bienvenida enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de bienvenida a {to_email}: {exc}")
        return False


async def send_subscription_confirmation_email(to_email: str, plan: str, name: Optional[str] = None) -> bool:
    """Send a subscription activation confirmation email via Resend. Never raises."""
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning("Resend no configurado; email de confirmación de suscripción omitido")
        return False

    display_name = name or to_email.split("@", 1)[0]
    plan_label = "Profesional" if plan == "profesional" else "Básico"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">¡Tu plan {plan_label} ya está activo, {display_name}!</h2>
      <p>Hemos confirmado tu pago y tu tienda de vendedor en VentaCofrade ya está activada.</p>
      <p>Ya puedes publicar tus anuncios y empezar a vender.</p>
      <p style="margin-top: 24px;">
        <a href="https://ventacofrade.com/cuenta/suscripcion" style="background-color:#6d28d9;color:#fff;
        padding:10px 20px;border-radius:6px;text-decoration:none;">Ver mi suscripción</a>
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": f"Tu plan {plan_label} está activo - VentaCofrade",
        "html": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de confirmación de suscripción enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de confirmación a {to_email}: {exc}")
        return False


async def send_waitlist_confirmation_email(to_email: str) -> bool:
    """Send a waitlist signup confirmation email via Resend. Never raises."""
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning("Resend no configurado; email de lista de espera omitido")
        return False

    html_content = """
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">¡Ya estás en la lista!</h2>
      <p>Gracias por apuntarte a VentaCofrade, el marketplace cofrade de referencia.</p>
      <p>Te avisaremos por email en cuanto abramos la plataforma. ¡Muy pronto!</p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": "¡Ya estás en la lista de espera de VentaCofrade!",
        "html": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de lista de espera enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de lista de espera a {to_email}: {exc}")
        return False


async def send_launch_announcement_email(to_email: str) -> bool:
    """Sent once, the day VentaCofrade actually launches, to everyone still
    on the waitlist (see services/scheduled_jobs.py::check_launch_announcement).
    Never raises."""
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning("Resend no configurado; email de lanzamiento omitido")
        return False

    html_content = """
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">¡Ya hemos abierto!</h2>
      <p>Han pasado semanas de espera y por fin es el día: <strong>VentaCofrade ya está abierto</strong>.</p>
      <p>
        Fuiste de los primeros en apuntarte, y eso significa algo para nosotros. Si te registras
        con este mismo email, tu perfil llevará la insignia <strong>Fundador</strong>, visible
        para siempre, como agradecimiento por haber confiado en el proyecto desde el principio.
      </p>
      <p style="margin: 24px 0;">
        <a href="https://www.ventacofrade.com" style="background:#6d28d9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Entrar en VentaCofrade
        </a>
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": "¡VentaCofrade ya está abierto! 🎉",
        "html": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de lanzamiento enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de lanzamiento a {to_email}: {exc}")
        return False


async def send_invitation_email(to_email: str, months: int, token: str) -> bool:
    """Send a branded 'you're invited, free access' email via Resend.

    The link carries a unique, single-use token (not the shared team bypass
    key), so access can be tracked and revoked per invitee.
    """
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning("Resend no configurado; email de invitacion omitido")
        return False

    site_url = "https://ventacofrade.com"
    access_url = f"{site_url}/login?invite={token}"

    duration_text = "1 mes" if months == 1 else f"{months} meses"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background:#faf9fb; padding: 24px; border-radius: 12px;">
      <div style="text-align:center; margin-bottom: 12px;">
        <img src="https://ventacofrade.com/logo-circle-email.png" alt="VentaCofrade" width="72" height="72" />
      </div>
      <h2 style="color: #6d28d9; text-align:center; margin-bottom: 4px;">Entra en Venta Cofrade</h2>
      <p style="text-align:center; color:#52525b; margin-top:0;">Hemos reservado un hueco especial para ti antes de nuestro lanzamiento oficial.</p>
      <p>Como invitado, puedes publicar tus artículos cofrades <strong>totalmente gratis
      durante {duration_text}</strong>, sin necesidad de suscripción.</p>
      <p style="text-align:center; margin-top: 24px;">
        <a href="{access_url}" style="background-color:#6d28d9;color:#fff;
        padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Entrar a VentaCofrade</a>
      </p>
      <p style="margin-top: 20px; color: #444; font-size: 14px;">
        Regístrate con este mismo correo ({to_email}) y una contraseña, y completa tu perfil
        de vendedor: el acceso gratuito se activará automáticamente en cuanto publiques tu primer anuncio.
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px; border-top: 1px solid #e4e4e7; padding-top: 16px;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:contacto@ventacofrade.com" style="color:#6d28d9;">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": "Estás invitado a VentaCofrade — publica gratis",
        "html": html_content,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de invitacion enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de invitacion a {to_email}: {exc}")
        return False


async def _send_via_resend(to_email: str, subject: str, html_content: str, log_label: str) -> bool:
    """Shared sender for the emails below — keeps the Resend call in one place."""
    api_key = getattr(settings, "resend_api_key", None)
    from_email = getattr(settings, "resend_from_email", None)

    if not api_key or not from_email:
        logger.warning(f"Resend no configurado; email de {log_label} omitido")
        return False

    payload = {"from": from_email, "to": [to_email], "subject": subject, "html": html_content}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            response.raise_for_status()
        logger.info(f"Email de {log_label} enviado a {to_email}")
        return True
    except httpx.HTTPError as exc:
        logger.error(f"Fallo al enviar email de {log_label} a {to_email}: {exc}")
        return False


async def send_raffle_prize_activated_email(to_email: str, deadline) -> bool:
    """Sent to a raffle winner the moment their 3 free months actually start
    counting (i.e. when the platform is publicly live), telling them they have
    15 days to publish a real listing or the prize can be revoked."""
    deadline_str = deadline.strftime("%d/%m/%Y")
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">¡Tu premio ya está activo! 🎉</h2>
      <p>VentaCofrade ya está abierta al público y tus <strong>3 meses de acceso gratuito</strong>
      para publicar como vendedor han empezado a contar hoy.</p>
      <p style="background:#fef3c7; padding:12px 16px; border-radius:8px; color:#92400e;">
        <strong>Importante:</strong> para conservar el premio, completa tu perfil de vendedor
        y publica al menos un anuncio real antes del <strong>{deadline_str}</strong> (15 días).
        Si no lo haces en ese plazo, el premio podrá ofrecerse a otra persona.
      </p>
      <p style="margin-top: 24px;">
        <a href="https://www.ventacofrade.com/cuenta/publicar" style="background-color:#6d28d9;
        color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Publicar mi primer anuncio</a>
      </p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        ¿Dudas? Escríbenos a <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """
    return await _send_via_resend(
        to_email, "¡Tu premio del sorteo ya está activo! Tienes 15 días para publicar", html_content,
        "premio de sorteo activado",
    )


async def send_raffle_deadline_reminder_email(to_email: str, deadline) -> bool:
    """Sent a few days before the 15-day publish deadline if the winner still
    hasn't published a real listing."""
    deadline_str = deadline.strftime("%d/%m/%Y")
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #b45309;">Tu premio del sorteo caduca pronto</h2>
      <p>Todavía no has publicado ningún anuncio en VentaCofrade con tu acceso gratuito del sorteo.</p>
      <p>Tienes hasta el <strong>{deadline_str}</strong> para publicar al menos un anuncio real,
      o el premio podrá revocarse y ofrecerse a otra persona participante.</p>
      <p style="margin-top: 24px;">
        <a href="https://www.ventacofrade.com/cuenta/publicar" style="background-color:#6d28d9;
        color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Publicar ahora</a>
      </p>
    </div>
    """
    return await _send_via_resend(
        to_email, "Quedan pocos días para usar tu premio del sorteo", html_content,
        "recordatorio de plazo de sorteo",
    )


async def send_raffle_prize_revoked_email(to_email: str) -> bool:
    """Sent when the 15-day window closed without a real listing published."""
    html_content = """
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #b91c1c;">Tu premio del sorteo ha sido revocado</h2>
      <p>El plazo de 15 días para publicar tu primer anuncio con el acceso gratuito del sorteo
      ha finalizado sin que se haya publicado ningún anuncio, así que el premio ha sido revocado
      conforme a las bases del sorteo.</p>
      <p>Si aún quieres vender en VentaCofrade, puedes hacerlo en cualquier momento activando
      uno de nuestros planes de suscripción.</p>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Si crees que esto es un error, escríbenos a
        <a href="mailto:contacto@ventacofrade.com">contacto@ventacofrade.com</a>.
      </p>
    </div>
    """
    return await _send_via_resend(
        to_email, "Tu premio del sorteo ha sido revocado", html_content, "revocación de premio de sorteo",
    )


async def send_subscription_renewal_reminder_email(to_email: str, plan: str, renewal_date) -> bool:
    """Sent 7 days before a subscription auto-renews (charges the card again)."""
    renewal_str = renewal_date.strftime("%d/%m/%Y")
    plan_label = "Profesional" if plan == "profesional" else "Básico"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #6d28d9;">Tu suscripción se renueva en 7 días</h2>
      <p>Tu plan <strong>{plan_label}</strong> de VentaCofrade se renovará automáticamente
      el <strong>{renewal_str}</strong>.</p>
      <p>Si quieres hacer algún cambio antes, puedes gestionar tu suscripción (cambiar de plan
      o cancelarla) desde tu cuenta.</p>
      <p style="margin-top: 24px;">
        <a href="https://www.ventacofrade.com/cuenta/suscripcion" style="background-color:#6d28d9;
        color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Gestionar mi suscripción</a>
      </p>
    </div>
    """
    return await _send_via_resend(
        to_email, "Tu suscripción a VentaCofrade se renueva en 7 días", html_content,
        "recordatorio de renovacion",
    )
