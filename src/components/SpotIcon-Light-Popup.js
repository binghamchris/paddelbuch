import React from "react";
import { useTranslation } from 'gatsby-plugin-react-i18next';
import { StaticImage } from "gatsby-plugin-image";

const SpotIconLightPopup = (props) => {

  const {t} = useTranslation();
  
  if (props.slug === "einsteig-aufsteig") {
    return (
      <div class="spot-icon-div">
        <p>
          <StaticImage
            src="../assets/images/icons/entryexit-light.svg"
            alt={t('Entry and exit spot icon')}           
            height="20"
            className="spot-icon popup-icon"
          />
          {props.name}
        </p>
      </div>
    );
  }
  else if (props.slug === "nur-einsteig") {
    return (
      <div class="spot-icon-div">
        <p>
          <StaticImage
            src="../assets/images/icons/entry-light.svg"
            alt={t('Entry spot icon')}           
            height="20"
            className="spot-icon popup-icon"
          />
          {props.name}
        </p>
      </div>
    );
  }

  else if (props.slug === "nur-aufsteig") {
    return (
      <div class="spot-icon-div">
        <p>
          <StaticImage
            src="../assets/images/icons/exit-light.svg"
            alt={t('Exit spot icon')}           
            height="20"
            className="spot-icon popup-icon"
          />
          {props.name}
        </p>
      </div>
    );
  }

  else if (props.slug === "notauswasserungsstelle") {
    return (
      <div class="spot-icon-div">
        <p>
          <StaticImage
            src="../assets/images/icons/emergency-light.svg"
            alt={t('Emergency exit spot icon')}           
            height="20"
            className="spot-icon popup-icon"
          />
          {props.name}
        </p>
      </div>
    );
  }

  else if (props.slug === "rasthalte") {
    return (
      <div class="spot-icon-div">
        <p>
          <StaticImage
            src="../assets/images/icons/rest-light.svg"
            alt={t('Rest spot icon')}           
            height="20"
            className="spot-icon popup-icon"
          />
          {props.name}
        </p>
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

export default SpotIconLightPopup;