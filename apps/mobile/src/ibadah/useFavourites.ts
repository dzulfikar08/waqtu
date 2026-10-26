import { useCallback } from "react";

import { parseFavourites, serializeFavourites, toggleFavourite } from "./labels";
import { useLocalValue } from "./store";

const FAVOURITES_KEY = "ibadah.duaFavourites";

/** The doa favourites, kept on this phone. `undefined` while loading. */
export function useFavourites(): [ReadonlySet<string> | undefined, (id: string) => void] {
  const [favourites, save] = useLocalValue(FAVOURITES_KEY, parseFavourites, serializeFavourites);
  const toggle = useCallback(
    (id: string) => {
      if (favourites) save(toggleFavourite(favourites, id));
    },
    [favourites, save],
  );
  return [favourites, toggle];
}
