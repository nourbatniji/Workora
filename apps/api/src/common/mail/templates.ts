// The two emails the MVP sends (D-14, SRS 2.4): an invite and a password reset, in Arabic and English.
// Each template gives a subject, a plain-text body (for any mail app) and a simple HTML body.

export type MailLanguage = 'ar' | 'en';

export type MailTemplate =
  | {
      kind: 'invite';
      /** The set-password link, valid 7 days (FR-UA-1) */
      link: string;
      companyName: string;
    }
  | {
      kind: 'passwordReset';
      /** The new-password link (FR-UA-4) */
      link: string;
      /** How long the link works, shown to the reader */
      validHours: number;
    };

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

/** Values inserted into HTML must never be read as HTML (a company named "<b>x</b>" stays text) */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A plain, readable email body; Arabic goes right-to-left */
function wrapHtml(
  language: MailLanguage,
  lines: string[],
  link: string,
  button: string,
) {
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const paragraphs = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  return `<!doctype html><html lang="${language}" dir="${dir}"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">${paragraphs}<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#2f5bea;color:#ffffff;border-radius:10px;text-decoration:none">${escapeHtml(button)}</a></p><p style="color:#6b7280;font-size:13px">${escapeHtml(link)}</p></body></html>`;
}

export function renderMail(
  template: MailTemplate,
  language: MailLanguage,
): RenderedMail {
  if (template.kind === 'invite') {
    const { link, companyName } = template;
    const t =
      language === 'ar'
        ? {
            subject: `دعوة للانضمام إلى ${companyName} على مدارج`,
            lines: [
              `تمت إضافتك إلى ${companyName} على نظام مدارج.`,
              'اضغط على الرابط لتعيين كلمة المرور. الرابط صالح لمدة 7 أيام.',
            ],
            button: 'تعيين كلمة المرور',
          }
        : {
            subject: `You're invited to ${companyName} on MDARJ`,
            lines: [
              `You have been added to ${companyName} on MDARJ.`,
              'Open the link to set your password. The link works for 7 days.',
            ],
            button: 'Set your password',
          };
    return {
      subject: t.subject,
      text: [...t.lines, '', link].join('\n'),
      html: wrapHtml(language, t.lines, link, t.button),
    };
  }

  const { link, validHours } = template;
  const t =
    language === 'ar'
      ? {
          subject: 'إعادة تعيين كلمة المرور في مدارج',
          lines: [
            'طلبت إعادة تعيين كلمة المرور.',
            `اضغط على الرابط لاختيار كلمة مرور جديدة. الرابط صالح لمدة ${validHours} ساعة.`,
            'إذا لم تطلب ذلك، تجاهل هذه الرسالة؛ كلمة مرورك لن تتغيّر.',
          ],
          button: 'اختيار كلمة مرور جديدة',
        }
      : {
          subject: 'Reset your MDARJ password',
          lines: [
            'You asked to reset your password.',
            `Open the link to choose a new password. The link works for ${validHours} hours.`,
            "If you didn't ask for this, ignore this email; your password stays the same.",
          ],
          button: 'Choose a new password',
        };
  return {
    subject: t.subject,
    text: [...t.lines, '', link].join('\n'),
    html: wrapHtml(language, t.lines, link, t.button),
  };
}
