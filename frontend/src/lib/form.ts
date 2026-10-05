import type { FormEvent } from "react";

/**
 * A form's onSubmit that hands its fields to `save`. Used instead of the `action`
 * prop, which makes React clear every field once the action ends — even when saving
 * failed and the person has to correct one field and try again.
 */
export function submitTo(save: (form: FormData) => unknown) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save(new FormData(e.currentTarget));
  };
}
