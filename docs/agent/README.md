# Context Directory

## Overview

This directory contains files to assist an AI code assistant in development and maintenance of this project.

AI assistants should use this directory for storage of development related documents like architecture proposals, implementation plans, progress tracking documents or other documents not intended to be exposed to end users.

Additional product documentation that is intended to be exposed to users of the project is stored in docs/

## Current directory contents

AI assistants should update this list whenever adding a new file, or when you discover an expected file is no longer present.

- debug-component-names.md
  Reference list of all debug component names for targeted logging configuration, organized by functional category (Auth, TM, DFD, etc.).

- DFD_GRAPH_INTERACTION.md
  This file describes how the user interacts with the graphing page.

- DFD_INTEGRATION_TESTING_APPROACH.md
  This file describes the integration testing approach implemented for DFD services to eliminate mock logic duplication and improve test reliability.

- DFD_INTEGRATION_TEST_PLAN.md
  This file defines a comprehensive integration test plan for the DFD graph component using real X6 graph operations without mocking, specifically designed to catch styling and state issues like selection styling persistence after undo/redo operations.

- DFD_PUBLIC_API_REFERENCE.md
  Comprehensive TypeScript API reference for the DFD component covering 60+ files, 550+ public methods, and complete layer-by-layer documentation.

- Interesting X6 Events.txt
  Log samples of X6 graph events showing actual event data for node operations, edge connections, selection changes, and data modifications during diagram editing.

- PDF_REPORT_DIAGRAM_RENDERING_DESIGN.md
  Design document for implementing pre-rendered diagram storage to enable full diagram inclusion in PDF reports using stored PNG/SVG images.

## Removed Files

The following files were previously in this directory but have been moved to their canonical locations:

- authorization.md → shared-api/docs/AUTHORIZATION.md
- CLIENT_INTEGRATION_GUIDE.md → shared-api/docs/CLIENT_INTEGRATION_GUIDE.md  
- CLIENT_OAUTH_INTEGRATION.md → shared-api/docs/CLIENT_OAUTH_INTEGRATION.md
- tmi_api_server_authentication.md → moved/merged with other auth documentation
- tmi-server-integration-plan.md → moved/merged with other integration documentation
- COLLABORATIVE_EDITING.md → consolidated into docs/WEBSOCKET_COLLABORATION.md
- Developers Guide AntVX6 Graphing Library v2.md → consolidated into docs/X6_COMPLETE_GUIDE.md
