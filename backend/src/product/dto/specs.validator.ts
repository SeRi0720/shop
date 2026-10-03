import { registerDecorator, type ValidationOptions } from 'class-validator';

const MAX_PAIRS = 30;
const MAX_KEY = 50;
const MAX_VALUE = 200;

export function IsSpecs(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isSpecs',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
          ) {
            return false;
          }
          const entries = Object.entries(value);
          return (
            entries.length <= MAX_PAIRS &&
            entries.every(
              ([k, v]) =>
                k.trim().length > 0 &&
                k.length <= MAX_KEY &&
                typeof v === 'string' &&
                v.length <= MAX_VALUE,
            )
          );
        },
        defaultMessage() {
          return `specs phải là object phẳng tối đa ${MAX_PAIRS} cặp, khóa ≤ ${MAX_KEY} ký tự, giá trị là chuỗi ≤ ${MAX_VALUE} ký tự`;
        },
      },
    });
  };
}
