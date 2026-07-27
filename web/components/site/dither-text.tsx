/**
 * A word rendered through a breathing halftone mask.
 *
 * Used to punch a single word out of a sentence — the mask makes the letters dissolve into dots
 * and reassemble, which is the whole aesthetic applied to type. Use it on one or two words per
 * screen; on a whole sentence it stops reading as emphasis and starts reading as a broken font.
 *
 * `data-text` duplicates the word into a faint solid layer underneath, so the shape survives even
 * at the sparsest point of the mask animation.
 */
export function DitherText({ children }: { children: string }) {
  return (
    <span className="dither-word" data-text={children}>
      {children}
    </span>
  );
}
