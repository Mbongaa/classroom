'use client';

import React from 'react';
import {Tabs, Tab, Card, CardBody, Switch} from "@heroui/react";

export default function TestHeroUI() {
  const [isVertical, setIsVertical] = React.useState(true);

  return (
    <div style={{ padding: '20px' }}>
      <Switch isSelected={isVertical} onValueChange={setIsVertical}>
        Vertical
      </Switch>
      <div style={{ marginTop: '20px' }}>
        <Tabs aria-label="Options" isVertical={isVertical}>
          <Tab key="photos" title="Photos">
            <Card>
              <CardBody>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </CardBody>
            </Card>
          </Tab>
          <Tab key="music" title="Music">
            <Card>
              <CardBody>
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit
                esse cillum dolore eu fugiat nulla pariatur.
              </CardBody>
            </Card>
          </Tab>
          <Tab key="videos" title="Videos">
            <Card>
              <CardBody>
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum.
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}