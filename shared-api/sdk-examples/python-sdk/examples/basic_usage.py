#!/usr/bin/env python3
"""
Basic usage example for TMI Python SDK.

This example demonstrates:
- Client initialization and authentication
- Creating and managing threat models
- Working with diagrams and threats
- Basic metadata operations
"""

import os
from tmi_client import TMIClient
from tmi_client.models import ThreatModel, Diagram, Threat


def main():
    # Initialize client with server URL
    server_url = os.getenv("TMI_SERVER_URL", "http://localhost:8080")
    client = TMIClient(server_url)
    
    print(f"Connecting to TMI server at {server_url}")
    
    # Authenticate - in a real app, you'd handle OAuth flow properly
    # For this example, we'll assume you have a token
    token = os.getenv("TMI_TOKEN")
    if token:
        client.set_token(token)
        print("✓ Token set successfully")
    else:
        print("Warning: No token provided. Some operations may fail.")
        print("Set TMI_TOKEN environment variable or implement OAuth flow.")
    
    try:
        # Test authentication
        if token:
            user_info = client.get_current_user()
            print(f"✓ Authenticated as: {user_info.get('email', 'unknown')}")
        
        # List existing threat models
        print("\n--- Listing Threat Models ---")
        threat_models = client.list_threat_models()
        print(f"Found {len(threat_models)} threat models")
        for tm in threat_models[:5]:  # Show first 5
            print(f"  - {tm.name} (ID: {tm.id})")
        
        # Create a new threat model
        print("\n--- Creating New Threat Model ---")
        new_threat_model = ThreatModel(
            name="Example Web Application",
            description="Security threat model for a sample web application",
            version="1.0",
            tags=["web", "example", "python-sdk"]
        )
        
        created_tm = client.create_threat_model(new_threat_model)
        print(f"✓ Created threat model: {created_tm.name} (ID: {created_tm.id})")
        
        # Add metadata to the threat model
        print("\n--- Adding Metadata ---")
        tm_path = f"/threat_models/{created_tm.id}"
        client.create_metadata_entry(tm_path, "created_by", "python-sdk-example")
        client.create_metadata_entry(tm_path, "project_phase", "development")
        print("✓ Added metadata entries")
        
        # Create a diagram
        print("\n--- Creating Diagram ---")
        new_diagram = Diagram(
            threat_model_id=created_tm.id,
            name="System Overview",
            description="High-level system architecture diagram",
            diagram_type="data_flow_diagram",
            content={
                "nodes": [
                    {"id": "user", "type": "external_entity", "name": "User"},
                    {"id": "web_app", "type": "process", "name": "Web Application"},
                    {"id": "database", "type": "datastore", "name": "User Database"}
                ],
                "flows": [
                    {"from": "user", "to": "web_app", "data": "HTTP Requests"},
                    {"from": "web_app", "to": "database", "data": "SQL Queries"}
                ]
            }
        )
        
        created_diagram = client.create_diagram(created_tm.id, new_diagram)
        print(f"✓ Created diagram: {created_diagram.name} (ID: {created_diagram.id})")
        
        # Create some threats
        print("\n--- Creating Threats ---")
        threats_to_create = [
            Threat(
                threat_model_id=created_tm.id,
                title="SQL Injection Attack",
                description="Attacker injects malicious SQL code through user input",
                category="Input Validation",
                severity="High",
                likelihood="Medium",
                impact="High",
                status="Open",
                tags=["injection", "database"]
            ),
            Threat(
                threat_model_id=created_tm.id,
                title="Cross-Site Scripting (XSS)",
                description="Attacker injects malicious scripts into web pages",
                category="Input Validation", 
                severity="Medium",
                likelihood="High",
                impact="Medium",
                status="Open",
                tags=["xss", "web"]
            ),
            Threat(
                threat_model_id=created_tm.id,
                title="Authentication Bypass",
                description="Attacker bypasses authentication mechanisms",
                category="Authentication",
                severity="Critical",
                likelihood="Low",
                impact="Critical", 
                status="Open",
                tags=["authentication", "bypass"]
            )
        ]
        
        # Use bulk create for efficiency
        created_threats = client.create_threats_bulk(created_tm.id, threats_to_create)
        print(f"✓ Created {len(created_threats)} threats")
        for threat in created_threats:
            print(f"  - {threat.title} ({threat.severity} severity)")
        
        # List all threats for the threat model
        print(f"\n--- All Threats for '{created_tm.name}' ---")
        all_threats = client.list_threats(created_tm.id)
        for threat in all_threats:
            print(f"  - {threat.title}: {threat.severity} severity, {threat.status} status")
        
        # Update a threat
        print("\n--- Updating Threat ---")
        threat_to_update = created_threats[0]
        threat_to_update.status = "In Review"
        threat_to_update.mitigation = "Implement parameterized queries and input validation"
        
        updated_threat = client.update_threat(created_tm.id, threat_to_update.id, threat_to_update)
        print(f"✓ Updated threat: {updated_threat.title} - Status: {updated_threat.status}")
        
        # Get collaboration sessions
        print("\n--- Checking Collaboration Sessions ---")
        try:
            sessions = client.get_collaboration_sessions()
            print(f"Found {len(sessions)} active collaboration sessions")
        except Exception as e:
            print(f"Could not get collaboration sessions: {e}")
        
        print(f"\n✓ Example completed successfully!")
        print(f"Created threat model ID: {created_tm.id}")
        print(f"Created diagram ID: {created_diagram.id}")
        print(f"Created {len(created_threats)} threats")
        
        # Note: In a real application, you might want to clean up test data
        # client.delete_threat_model(created_tm.id)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())