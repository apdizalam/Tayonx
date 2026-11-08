import FilePicker from './FilePicker.jsx';
import Icon from './Icon.jsx';
import { ACCOUNT_TYPES, COUNTRIES } from '../lib/accountFields.js';

function Field({ id, label, hint, error, icon, children }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`account-field${error ? ' has-error' : ''}`}>
      <label className="account-field-label" htmlFor={id}>{label}</label>
      <div className={`account-input${icon ? ' with-icon' : ''}`}>
        {icon && <Icon name={icon} size={16} />}
        {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      </div>
      {hint && !error && <small className="account-field-hint" id={`${id}-hint`}>{hint}</small>}
      {error && <p className="account-field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

/**
 * The role-dependent account fields (name, phone, email, country, optional profile photo).
 * `values` holds the field values, `errors` the per-field messages, `onChange(field, value)` updates one field.
 */
export default function AccountFields({ role, values, errors = {}, onChange, idPrefix = 'account', includePhoto = true }) {
  const type = ACCOUNT_TYPES[role] || ACCOUNT_TYPES.customer;
  const set = (field) => (event) => onChange(field, event.target.value);

  return (
    <div className="account-fields">
      <Field id={`${idPrefix}-name`} label={type.nameLabel} hint={type.nameHint} error={errors.name} icon={type.nameKind === 'company' ? 'building' : 'user'}>
        {(props) => <input {...props} name="name" value={values.name} onChange={set('name')} placeholder={type.namePlaceholder} autoComplete={type.nameKind === 'company' ? 'organization' : 'name'} maxLength={100} required />}
      </Field>
      <div className="account-fields-row">
        <Field id={`${idPrefix}-phone`} label="Phone number" error={errors.phone} icon="phone">
          {(props) => <input {...props} name="phone" type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} placeholder="+252 63 412 3456" autoComplete="tel" maxLength={20} required />}
        </Field>
        <Field id={`${idPrefix}-country`} label="Country" error={errors.country} icon="globe">
          {(props) => (
            <select {...props} name="country" value={values.country} onChange={set('country')} required>
              <option value="" disabled>Choose country</option>
              {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          )}
        </Field>
      </div>
      <Field id={`${idPrefix}-email`} label="Email address" error={errors.email} icon="mail">
        {(props) => <input {...props} name="email" type="email" value={values.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" maxLength={254} required />}
      </Field>
      {includePhoto && type.profilePhoto && (
        <FilePicker
          id={`${idPrefix}-photo`}
          variant="photo"
          label="Profile picture"
          hint="JPG, PNG or WebP · max 5 MB"
          accept="image/jpeg,image/png,image/webp"
          file={values.profilePhoto || null}
          error={errors.profilePhoto}
          onChange={(file) => onChange('profilePhoto', file)}
        />
      )}
    </div>
  );
}
