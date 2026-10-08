/** Replaces every {{key}} in template with vars[key]. Throws if a key used in the template is missing from vars. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Falta la variable de plantilla "${key}".`)
    }
    return vars[key] as string
  })
}
