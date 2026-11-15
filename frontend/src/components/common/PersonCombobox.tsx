import { useId, useState, type KeyboardEvent, type RefObject } from 'react'

import { floatingSurface, inputBase, inputDisabled } from '../../lib/buttonStyles'

export interface PersonOption {
  email: string
  full_name: string
  /** A quiet second line: when they joined, their last sign-in… */
  hint?: string
}

/** Lowercase without accents: "José" matches "jose". */
function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const MAX_SHOWN = 8

/** An email field that suggests people by name or email as you type (the
 * ARIA 1.2 combobox: a text input with a popup listbox), still taking any
 * address typed -- the suggestions are only those the server listed for
 * the caller (e.g. Admin's newcomers from the allowed domains). Arrow keys
 * move through them, Enter picks one, Escape closes the list. */
export function PersonCombobox({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  inputRef,
  describedBy,
}: {
  id: string
  name?: string
  value: string
  onChange: (email: string) => void
  options: PersonOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  describedBy?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const needle = fold(value.trim())
  const matches = options
    .filter(
      (option) =>
        !needle || fold(option.full_name).includes(needle) || fold(option.email).includes(needle),
    )
    // Picked already: nothing left to suggest.
    .filter((option) => option.email.toLowerCase() !== value.trim().toLowerCase())
    .slice(0, MAX_SHOWN)
  const expanded = open && matches.length > 0
  const optionId = (index: number) => `${listId}-option-${index}`

  function pick(option: PersonOption) {
    onChange(option.email)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => (matches.length ? (index + 1) % matches.length : -1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => (matches.length ? (index <= 0 ? matches.length - 1 : index - 1) : -1))
    } else if (event.key === 'Enter' && expanded && active >= 0 && matches[active]) {
      // Picks the suggestion instead of submitting the form.
      event.preventDefault()
      pick(matches[active])
    } else if (event.key === 'Escape' && expanded) {
      // Closes the list, not the form around it.
      event.stopPropagation()
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="email"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        required={required}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        // Late enough for a click on an option to land first.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={disabled ? inputDisabled : inputBase}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!expanded}
        className={`${floatingSurface} absolute right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-sm py-1`}
      >
        {matches.map((option, index) => (
          <li
            key={option.email}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Keep focus in the input: the click picks without blurring it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(option)}
            onMouseEnter={() => setActive(index)}
            className={`cursor-pointer px-3 py-2 text-sm ${index === active ? 'bg-hover' : ''}`}
          >
            <span className="block font-medium text-paper-ink dark:text-fg">
              {option.full_name}
            </span>
            <span className="block text-xs text-paper-ink/70 dark:text-fg-muted">
              {option.email}
              {option.hint ? ` · ${option.hint}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
