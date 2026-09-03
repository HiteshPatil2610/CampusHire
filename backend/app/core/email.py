"""
Email utilities.  In development the emails are logged to stdout.
Set SMTP_USER and SMTP_PASSWORD in .env for real sending.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_USER:
        # Dev mode — just print
        print(f"\n{'='*60}")
        print(f"TO: {to}")
        print(f"SUBJECT: {subject}")
        print(html)
        print("="*60 + "\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, to, msg.as_string())


def send_otp_email(to: str, otp: str, purpose: str = "REGISTRATION") -> None:
    subjects = {
        "REGISTRATION": "Verify your CampusHire account",
        "PASSWORD_RESET": "Reset your CampusHire password",
        "EMAIL_CHANGE": "Verify your new email address",
    }
    subject = subjects.get(purpose, "Your CampusHire OTP")
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#D85A30">CampusHire</h2>
      <p>Your one-time verification code is:</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1C1C1A;
                  background:#FAF9F5;padding:20px;border-radius:8px;text-align:center">
        {otp}
      </div>
      <p style="color:#6B6A63;font-size:13px">
        This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """
    _send(to, subject, html)


def send_credentials_email(to: str, full_name: str, temp_password: str) -> None:
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#D85A30">CampusHire</h2>
      <p>Hi {full_name}, your account has been created.</p>
      <p><b>Email:</b> {to}</p>
      <p><b>Temporary password:</b>
        <code style="background:#FAF9F5;padding:4px 8px;border-radius:4px">{temp_password}</code>
      </p>
      <p style="color:#6B6A63;font-size:13px">
        You will be asked to change your password on first login.
      </p>
    </div>
    """
    _send(to, "Your CampusHire login credentials", html)
