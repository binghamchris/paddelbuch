import React from "react";
import { useTranslation } from '@herob/gatsby-plugin-react-i18next';
import { StaticImage } from "gatsby-plugin-image";

const SpotIconLightPopup = (props) => {

  const {t} = useTranslation();
  
  if (props.slug === "einstieg-aufstieg") {
    return (
      <div class="popup-icon-div">
          <StaticImage
            src="../assets/images/icons/entryexit-light.svg"
            alt={t('Entry and exit spot icon')}           
            height={20}
            className="popup-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "nur-einstieg") {
    return (
      <div class="popup-icon-div">
          <StaticImage
            src="../assets/images/icons/entry-light.svg"
            alt={t('Entry spot icon')}           
            height={20}
            className="popup-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "nur-aufstieg") {
    return (
      <div class="popup-icon-div">
          <StaticImage
            src="../assets/images/icons/exit-light.svg"
            alt={t('Exit spot icon')}           
            height={20}
            className="popup-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "notauswasserungsstelle") {
    return (
      <div class="popup-icon-div">
          <StaticImage
            src="../assets/images/icons/emergency-light.svg"
            alt={t('Emergency exit spot icon')}           
            height={20}
            className="popup-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "rasthalte") {
    return (
      <div class="popup-icon-div">
          <StaticImage
            src="../assets/images/icons/rest-light.svg"
            alt={t('Rest spot icon')}           
            height={20}
            className="popup-icon"
          />
          {props.name}
      </div>
    );
  }
  else {
    return (
      <div class="spot-icon-div">
        {props.name}
      </div>
    )
  }
}

export default SpotIconLightPopup;