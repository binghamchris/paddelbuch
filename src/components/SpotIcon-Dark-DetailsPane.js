import React from "react";
import { useTranslation } from '@herob191/gatsby-plugin-react-i18next';
import { StaticImage } from "gatsby-plugin-image";

const SpotIconDarkDetailsPane = (props) => {

  const {t} = useTranslation();
  
  if (props.slug === "einstieg-ausstieg") {
    return (
      <div className="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/entryexit-dark.svg"
            alt={t('Entry and exit spot icon')}           
            height={20}
            className="spot-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "nur-einstieg") {
    return (
      <div className="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/entry-dark.svg"
            alt={t('Entry spot icon')}           
            height={20}
            className="spot-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "nur-ausstieg") {
    return (
      <div className="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/exit-dark.svg"
            alt={t('Exit spot icon')}           
            height={20}
            className="spot-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "notauswasserungsstelle") {
    return (
      <div className="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/emergency-dark.svg"
            alt={t('Emergency exit spot icon')}           
            height={20}
            className="spot-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "rasthalte") {
    return (
      <div className="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/rest-dark.svg"
            alt={t('Rest spot icon')}           
            height={20}
            className="spot-icon"
          />
          {props.name}
      </div>
    );
  }
  else if (props.slug === "rejected") {
    return (
      <div class="spot-icon-div">
          <StaticImage
            src="../assets/images/icons/noentry-dark.svg"
            alt={t('No entry spot icon')}           
            height={20}
            className="spot-icon"
          />
          {t("No Entry Spot")}
      </div>
    );
  }
  else {
    return (
      <div className="spot-icon-div">
        {props.name}
      </div>
    )
  }
}

export default SpotIconDarkDetailsPane;