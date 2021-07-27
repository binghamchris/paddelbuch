import React from "react";
import PropTypes from "prop-types";
import { Helmet } from "react-helmet";

import "assets/stylesheets/application.scss";

import { Container, Row, Col } from "react-bootstrap";
import Header from "components/Header";
//import Footer from "components/Footer";
 
const Layout = ({ children, pageName }) => {
  let className = "";

  if (pageName) {
    className = `${className} page-${pageName}`;
  }

  return (
    <>
      <Helmet bodyAttributes={{ class: className }}>
        <title>Swiss Paddel Buch</title>
      </Helmet>
      <Container fluid className="px-0 main">
          <Row noGutters className="justify-content-center">
            <Col>
              <Header />
            </Col>
          </Row>
          
          <Row noGutters>
            <Col>
              
              <main>{children}</main>
              
            </Col>
          </Row>
        </Container>
        
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  pageName: PropTypes.string,
};


export default Layout;
