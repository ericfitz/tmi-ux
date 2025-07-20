# Context Directory

## Overview

This directory contains files to assist an AI code assistant in development and maintenance of this project.

AI assistants should use this directory for storage of development related documents like architecture proposals, implementation plans, progress tracking documents or other documents not intended to be exposed to end users.

Additional product documentation that is intended to be exposed to users of the project is stored in docs/

## Current directory contents

AI assistants should update this list whenever adding a new file, or when you discover an expected file is no longer present.

- authorization.md
  This file describes how authorization checks are performed by the TMI server and how they are expected to be performed in this project.

- Developers Guide AntVX6 Graphing Library v2.md
  This file contains a developer focused reference to the objects, methods, attributes, functions and events implemented in the AntV X6 graphing library v2.

- DFD_GRAPH_INTERACTION.md
  This file describes how the user interacts with the graphing page.

- tmi_api_server_authentication.md
  This file describes how the application and the TMI server will jointly implement OAuth authentication.

- tmi-server-integration-plan.md
  This file describes how we will integrate the application and the TMI server.

- INTEGRATION_TESTING_APPROACH.md
  This file describes the integration testing approach implemented for DFD services to eliminate mock logic duplication and improve test reliability.

- DFD_INTEGRATION_TEST_PLAN.md
  This file defines a comprehensive integration test plan for the DFD graph component using real X6 graph operations without mocking, specifically designed to catch styling and state issues like selection styling persistence after undo/redo operations.
