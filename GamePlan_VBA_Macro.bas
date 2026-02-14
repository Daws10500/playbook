Attribute VB_Name = "Sheet8"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True

'=============================================================
' VBA Macro for Flag Football Play Tracker
' Sheet: Game Plan - 30 Plays
'
' PURPOSE: When a play name or arrow is clicked in the
' Game Plan, this macro:
'   1. Sets the PlayViewer play number (B3)
'   2. Loads the correct players into the sticky header
'   3. Navigates directly to the play diagram
'=============================================================

Private Sub Worksheet_FollowHyperlink(ByVal Target As Hyperlink)
    Dim r As Long
    r = Target.Range.Row
    
    ' Only handle clicks in the play data range (rows 6-41)
    If r < 6 Or r > 41 Then Exit Sub
    
    ' Get play number from column A
    Dim playNum As Variant
    playNum = Me.Cells(r, 1).Value
    If Not IsNumeric(playNum) Then Exit Sub
    
    ' Set PlayViewer B3 to trigger VLOOKUP formulas
    Dim pvSheet As Worksheet
    Set pvSheet = ThisWorkbook.Sheets("PlayViewer")
    pvSheet.Range("B3").Value = CLng(playNum)
    
    ' Get play type from column C for diagram lookup
    Dim playType As String
    playType = Me.Cells(r, 3).Value
    
    ' Map play type to diagram start row
    Dim diagRow As Long
    Select Case playType
        Case "Tick": diagRow = 9
        Case "Tick Tock": diagRow = 51
        Case "Circle - Run Option": diagRow = 96
        Case "Circle - Pass Option": diagRow = 141
        Case "Eagle": diagRow = 186
        Case "Airplane - Pass Option": diagRow = 231
        Case "Sweep": diagRow = 276
        Case "Cross": diagRow = 321
        Case "Circle - Reverse": diagRow = 366
        Case Else: diagRow = 1
    End Select
    
    ' Navigate to PlayViewer at the diagram row
    pvSheet.Activate
    Application.Goto pvSheet.Range("A" & diagRow), True
End Sub
