  I've successfully implemented the feature to disable the "Organize" and "Reorganize" buttons while any of the pipelines (PDF processing, organization, or reorganization) are running:

  1. Added pipeline state tracking in the main process (src/index.ts):
    - Created state variables: isPdfPipelineRunning, isOrganizationPipelineRunning, isReorganizationPipelineRunning
    - Update these states when pipelines start and finish (with proper error handling)
    - Added IPC handler get-pipeline-states to retrieve current states
  2. Updated the preload script (src/preload.ts):
    - Exposed getPipelineStates method to get current pipeline states
    - Added onPipelineStateChanged listener for real-time updates
  3. Enhanced the renderer (src/renderer.ts):
    - Added pipeline state tracking in the PDFRenamerApp class
    - Created updateButtonStates() method to enable/disable buttons based on pipeline states
    - Added checkInitialPipelineStates() to get states on app startup
    - Listens for pipeline state changes via IPC
  4. Broadcast pipeline state changes:
    - Send state updates whenever a pipeline starts or finishes
    - Send initial states when the window loads
    - Handle auto-organization pipeline state changes

  The buttons will now be disabled whenever any pipeline is running, preventing users from triggering concurrent operations that could cause conflicts.