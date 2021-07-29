import React from "react";

import { useSiteMetadata } from "hooks";

import Container from "components/Container";

const Footer = () => {
  const { authorName, authorUrl } = useSiteMetadata();

  return (
    <footer>
      <Container>
        <p>
          &copy; {new Date().getFullYear()},{" "}
          {authorName}
        </p>
      </Container>
    </footer>
  );
};

export default Footer;
