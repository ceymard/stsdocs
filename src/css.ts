
/**
 * Here, all the css classes that will be used are defined.
 */
export const classes = [

  // A link to a documentation page to a single item.
  'link',
  // A documentation section
  'doc',
  // The name of the current symbol for which documentation is printed.
  'name',
  'block',
  'kind',
  'error',

  // All the following are used in conjuncion with the classes defined above.
  'kind_function',
  'kind_class',
  'kind_enum',
  'kind_const',
  'kind_var',
  'kind_interface',
  'kind_namespace',
  'kind_typealias'
] as const

export const class_map = {} as {[K in typeof classes[number]]: string}
for (var c of classes) {
  class_map[c] = 'st-' + c.replace(/_/g, '-')
}

export default class_map