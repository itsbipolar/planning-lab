// The words the page never uses (SPEC.md sections 1 and 13), shared by words.test.mjs and page.spec.mjs.
export const BANNED = /\bshould\b|recommend|\bbest\b|consider|right for you|\bbuy|purchas|\bquot(e|ed|es|ing)\b|coverage|protect|agent|licen[cs]ed|LLQP|advis[eo]r|planner|\bsav(ing|ings|ed)\b|\bsafe\b|superior|strongest|largest|outperform|beat the market|your insurer|the insurer[’']s|typical period|smoothing period of|insurers use|\$\s?\d/i;
export const STAMP = 'Hypothetical illustration · Education, not advice';
export const NOT_G = 'Dividends are not guaranteed: a life insurer’s board declares them, typically once a year, and they can go down.';
export const ASSUME = 'A made-up account: the bond yields are real (Bank of Canada); everything else is invented, including the stock swings. Not any insurer’s account, method or rates.';
export const CLOSE = 'How any of this applies to a real policy is a question for the insurer that issued it or a qualified professional.';
// the control's own label: its value text says "a setting to explore" (aria-valuetext) and its help line says so too
export const CONTROL_LABEL = 'Spread stock and property swings';
