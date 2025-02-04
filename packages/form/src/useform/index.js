import { isArray, resolve } from '@primeuix/utils';
import { computed, mergeProps, nextTick, onMounted, reactive, toValue, watch } from 'vue';

function tryOnMounted(fn, sync = true) {
    if (getCurrentInstance()) onMounted(fn);
    else if (sync) fn();
    else nextTick(fn);
}

export const useForm = (options = {}) => {
    const states = reactive({});
    const fieldOptionMap = reactive({});
    const valid = computed(() => Object.values(states).every((field) => !field.invalid));

    const getInitialState = (field) => {
        return {
            value: options.initialValues?.[field],
            touched: false,
            dirty: false,
            pristine: true,
            valid: true,
            invalid: false,
            error: null,
            errors: []
        };
    };

    const isFieldValidate = (field, validateOn) => {
        const value = resolve(validateOn, field);

        return value === true || (isArray(value) && value.includes(field));
    };

    const defineField = (field, fieldOptions) => {
        states[field] ||= getInitialState(field);
        fieldOptionMap[field] = fieldOptions;

        const props = mergeProps(resolve(fieldOptions, states[field])?.props, resolve(fieldOptions?.props, states[field]), {
            name: field,
            onBlur: () => {
                states[field].touched = true;
                (fieldOptions?.validateOnBlur ?? isFieldValidate(field, options.validateOnBlur)) && validate(field);
            },
            onInput: (event) => {
                states[field].value = event.hasOwnProperty('value') ? event.value : event.target.value;
            },
            onChange: (event) => {
                states[field].value = event.hasOwnProperty('value') ? event.value : event.target.type === 'checkbox' || event.target.type === 'radio' ? event.target.checked : event.target.value;
            },
            onInvalid: (errors) => {
                states[field].invalid = true;
                states[field].errors = errors;
                states[field].error = errors?.[0] ?? null;
            }
        });

        watch(
            () => states[field].value,
            (newValue, oldValue) => {
                if (states[field].pristine) {
                    states[field].pristine = false;
                }

                if (newValue !== oldValue) {
                    states[field].dirty = true;
                }

                (fieldOptions?.validateOnValueUpdate ?? isFieldValidate(field, options.validateOnValueUpdate ?? true)) && validate(field);
            }
        );

        return [states[field], props];
    };

    const handleSubmit = (callback) => {
        return async (event) => {
            let results = undefined;

            (options.validateOnSubmit ?? true) && (results = await validate());

            return callback({
                originalEvent: event,
                valid: toValue(valid),
                states: toValue(states),
                reset,
                ...results
            });
        };
    };

    const validate = async (field) => {
        const names = Object.keys(states) ?? [];
        const values = Object.entries(states).reduce((acc, [key, val]) => {
            acc[key] = val.value;

            return acc;
        }, {});

        const result = (await options.resolver?.({ values, names })) ?? {};

        for (const sField of Object.keys(states)) {
            if (sField === field || !field) {
                const errors = result.errors?.[sField] ?? [];
                //const value = result.values?.[sField] ?? states[sField].value;

                states[sField].invalid = errors.length > 0;
                states[sField].valid = !states[sField].invalid;
                states[sField].errors = errors;
                states[sField].error = errors?.[0] ?? null;
                //states[sField].value = value;
            }
        }

        return result;
    };

    const reset = () => {
        Object.keys(states).forEach((field) => (states[field] = getInitialState(field)));
    };

    const validateOnMounted = () => {
        const field = Object.keys(fieldOptionMap).find((field) => fieldOptionMap[field]?.validateOnMount);

        field && validate(field);
        isArray(options.validateOnMount) ? options.validateOnMount.forEach(validate) : validate();
    };

    options.validateOnMount && tryOnMounted(validateOnMounted);

    return {
        defineField,
        handleSubmit,
        validate,
        reset,
        valid,
        states
    };
};
