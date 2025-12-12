import type { Locale } from '../../../src/config/i18n';
import './LanguageSwitch.css';

interface Props {
  locale: Locale;
  onChange: (next: Locale) => void | Promise<void>;
}

export function LanguageSwitch({ locale, onChange }: Props) {
  const toggleId = 'lang-toggle';
  return (
    <div className="lang-toggle">
      <input
        id={toggleId}
        type="checkbox"
        checked={locale === 'en'}
        onChange={(event) => onChange(event.target.checked ? 'en' : 'zh')}
        aria-label="Toggle language"
      />
      <label htmlFor={toggleId} className="lang-toggle-face">
        <span className="lang-face zh">中</span>
        <span className="lang-face en">EN</span>
      </label>
    </div>
  );
}
