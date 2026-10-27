import React from "react";
import { Composition } from "remotion";
import { HeroFilm, FILM } from "./HeroFilm.jsx";

export const Root = () => <Composition id="HeroFilm" component={HeroFilm} {...FILM} />;
