import * as v from 'valibot'

const text = (max: number) => v.pipe(v.string(), v.maxLength(max, `${max} caractères maximum`))
const optionalText = (max: number) => v.optional(v.nullable(text(max)))
const int = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max))

export const setupSchema = v.object({ householdName: text(60), occupantName: text(60) })
export const joinSchema = v.object({ occupantName: text(60) })

export const householdPatchSchema = v.partial(
  v.object({ name: text(60), sessionTime: v.string(), timezone: v.string(), summerStart: v.string(), winterStart: v.string() }),
)

export const roomSchema = v.object({ name: text(40) })

const rhythmSchema = v.variant('kind', [
  v.object({ kind: v.literal('weekly'), days: v.array(v.picklist([0, 1, 2, 3, 4, 5, 6])), everyWeeks: int(1, 52) }),
  v.object({ kind: v.literal('interval'), everyDays: int(1, 365) }),
])

export const plantSchema = v.object({
  name: text(80),
  scientificName: optionalText(120),
  description: optionalText(2000),
  care: v.optional(
    v.object({
      exposure: v.optional(v.picklist(['direct-sun', 'bright-indirect', 'partial-shade', 'shade'])),
      humidity: v.optional(v.picklist(['low', 'medium', 'high'])),
      watering: v.optional(text(500)),
      temperature: v.optional(text(100)),
      notes: v.optional(text(2000)),
    }),
  ),
  roomId: v.optional(v.nullable(v.string())),
  summerRhythm: rhythmSchema,
  winterRhythm: v.optional(v.nullable(rhythmSchema)),
})

export const pushSubscriptionSchema = v.object({
  endpoint: v.pipe(v.string(), v.url()),
  keys: v.object({ p256dh: v.string(), auth: v.string() }),
})

export const deviceCodeSchema = v.object({ code: text(20) })

export const endpointSchema = v.object({ endpoint: v.string() })
