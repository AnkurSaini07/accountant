

/** Enter in a field submits the form, as before: the visible Save sits in the sticky header,
 *  outside the <form> (linked by form=), which not every browser treats as the default button. */
export const EnterSubmits = () => <button type="submit" hidden tabIndex={-1} />;
