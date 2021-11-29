import React from "react";
import { graphql, useStaticQuery } from "gatsby"
import { Navbar, Nav, NavDropdown } from "react-bootstrap"
import { Link, useI18next, Trans, useTranslation, I18nextContext } from 'gatsby-plugin-react-i18next';
import { StaticImage } from "gatsby-plugin-image";
import "@fontsource/gowun-dodum";

const Header = () => {
  const {t} = useTranslation();

  const {languages, originalPath} = useI18next();
  const context = React.useContext(I18nextContext);

  const language = context.language

  const { waterways } = useStaticQuery(graphql`
    query {
      waterways: allGraphCmsWaterway(
        filter: {showInMenu: {eq: true}}
        sort: {fields: name}
      ) {
        nodes {
          name
          slug
          locale
          paddlingEnvironments {
            slug
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
          <Navbar.Brand as="span">
            <StaticImage
              src="../assets/images/logo.png"
              alt="The Swiss Paddel Buch Logo"
              width="33.75"
              height="33.75"
              className="paddelbuch-logo"
            />
            Swiss Paddel Buch
          </Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav className="mr-auto" >
            <NavDropdown title={t('Lakes')} id="nav-dropdown-lakes" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironments.slug === "see" && waterway.locale === language)
                .map(waterway => {
                  const{name, slug} = waterway;
              
                    return (
                      <NavDropdown.Item key={slug}>
                        <Link to={`/wasserlaeufe/${slug}`} className="link-no-style">
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
                <Link to={`/wasserlaeufe/seen`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More lakes</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Rivers')} id="nav-dropdown-rivers" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironments.slug === "fluss" && waterway.locale === language)
                .map(waterway => {
                  const{name, slug} = waterway;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/wasserlaeufe/${slug}`} className="link-no-style">
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
                <Link to={`/wasserlaeufe/fluesse`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More rivers</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <Link to="/ueber" className="link-no-style">
              <Nav.Link as="span" eventKey="spots">
                <Trans>About</Trans>
              </Nav.Link>
            </Link>

            <NavDropdown.Divider />
            <NavDropdown title={t('Language')} id="nav-dropdown-lang" className="link-no-style languages" align="end">
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
