import React from "react";
import { Text } from "ink";

const ART = String.raw`
                 /eeeeeeeeeee\
   /RRRRRRRRRR\ /eeeeeeeeeeeee\ /RRRRRRRRRR\
  /RRRRRRRRRRRR\|eeeeeeeeeeeee|/RRRRRRRRRRRR\
 /RRRRRRRRRRRRRR +++++++++++++ RRRRRRRRRRRRRR\
|RRRRRRRRRRRRRR ############### RRRRRRRRRRRRRR|
|RRRRRRRRRRRRR ######### ####### RRRRRRRRRRRRR|
 \RRRRRRRRRRR ######### ######### RRRRRRRRRR/
   |RRRRRRRRR ########## ######## RRRRRRRR|
  |RRRRRRRRRR ################### RRRRRRRRR|
               ######     ######
               #####       #####
               #nnn#       #nnn#
`.replace(/^\n/, "").trimEnd();

export function MaskArt() {
  return (
    <Text color="#DB0028" wrap="truncate-end">
      {ART}
    </Text>
  );
}
