import React from "react";
import { graphql, useStaticQuery } from "gatsby"
import { Navbar, Nav, NavDropdown } from "react-bootstrap"
import { Link, useI18next, Trans, useTranslation } from 'gatsby-plugin-react-i18next';

const Header = () => {
  const {t} = useTranslation();

  const {languages, originalPath} = useI18next();

  const { waterways } = useStaticQuery(graphql`
    query {
      waterways: allGraphCmsWaterway(
        filter: {locale: {eq: en}, showInMenu: {eq: true}}
        sort: {fields: name}
      ) {
        nodes {
          name
          slug
          paddlingEnvironments {
            name
          }
        }
      }
    }
  `);

  return (
    <header>
      <Navbar variant="dark" expand="lg" id="site-navbar">
        {/* <Container> */}
        <Link to="/" className="link-no-style">
          <Navbar.Brand as="span">Swiss Paddel Buch</Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav className="mr-auto" >
            <Link to="/" className="link-no-style">
              <Nav.Link as="span" eventKey="spots">
                <Trans>Spots</Trans>
              </Nav.Link>
            </Link>
            <NavDropdown title={t('Lakes')} id="nav-dropdown-lakes" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironments.name === "Lake")
                .map(waterway => {
                  const{name, slug} = waterway;
              
                    return (
                      <NavDropdown.Item key={slug}>
                        <Link to={`/waterways/${slug}`} className="link-no-style">
                          <Nav.Link as="span">
                            {name}
                          </Nav.Link>
                        </Link>
                      </NavDropdown.Item>
                    )
                })
              }
              <NavDropdown.Divider />
              <NavDropdown.Item>
                <Link to={`/waterways/lakes`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More lakes</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Rivers')} id="nav-dropdown-rivers" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironments.name === "River")
                .map(waterway => {
                  const{name, slug} = waterway;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/waterways/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {name}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
              }
              <NavDropdown.Divider />
              <NavDropdown.Item>
                <Link to={`/waterways/rivers`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More rivers</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Whitewater')} id="nav-dropdown-whitewater" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironments.name === "Whitewater")
                .map(waterway => {
                  const{name, slug} = waterway;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/waterways/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {name}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
              }
              <NavDropdown.Divider />
              <NavDropdown.Item>
                <Link to={`/waterways/whitewater`} className="link-no-style">
                  <Nav.Link as="span">          
                    <Trans>More whitewater</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('About')} id="nav-dropdown-about" className="link-no-style" align="end">
              <NavDropdown.Item>
                <Link to="/about" className="link-no-style">
                  <Nav.Link as="span" eventKey="about">
                    <Trans>About Swiss Paddel Buch</Trans>
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
              <NavDropdown.Item>
                <Link to="/about/api" className="link-no-style">
                  <Nav.Link as="span" eventKey="api">
                    <Trans>Public Database/API</Trans>
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Language')} id="nav-dropdown-about" className="link-no-style languages" align="end">
              {languages.map((lng) => (
                <NavDropdown.Item>
                <Link to={originalPath} className="link-no-style" language={lng}>
                  <Nav.Link as="span" eventKey={lng}>
                    {lng}
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
              ))}
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
        {/* </Container> */}
      </Navbar>

    </header>
  );
};

export default Header;
