import React from "react";
import entryExitBlack from "assets/images/icons/entryexit-black.png";
import entryBlack from "assets/images/icons/entry-black.png";
import exitBlack from "assets/images/icons/exit-black.png";
import emergencyBlack from "assets/images/icons/emergency-black.png";
import restBlack from "assets/images/icons/rest-black.png";
import { useTranslation } from 'gatsby-plugin-react-i18next';

const SpotIconBlack = (props) => {

  const {t} = useTranslation();
  
  if (props.slug === "einsteig-aufsteig") {
    return (
      <div class="spot-icon-div">
        <p><img src={entryExitBlack} class="spot-icon" alt={t('Entry and exit spot icon')}/> {props.name}</p>
      </div>
    );
  }
  else if (props.slug === "nur-einsteig") {
    return (
      <div class="spot-icon-div">
        <p><img src={entryBlack} class="spot-icon" alt={t('Entry spot icon')}/> {props.name}</p>
      </div>
    );
  }

  else if (props.slug === "nur-aufsteig") {
    return (
      <div class="spot-icon-div">
        <p><img src={exitBlack} class="spot-icon" alt={t('Exit spot icon')}/> {props.name}</p>
      </div>
    );
  }

  else if (props.slug === "notauswasserungsstelle") {
    return (
      <div class="spot-icon-div">
        <p><img src={emergencyBlack} class="spot-icon" alt={t('Emergency exit spot icon')}/> {props.name}</p>
      </div>
    );
  }

  else if (props.slug === "rasthalte") {
    return (
      <div class="spot-icon-div">
        <p><img src={restBlack} class="spot-icon" alt={t('Rest spot icon')}/> {props.name}</p>
      </div>
    );
  }

  else {
    return (
      <div class="spot-icon-div">
        <p>{props.name}</p>
      </div>
    )
  }
}

export default SpotIconBlack;